import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { updateUserPassword } from '../../utils/storage';
import { Lock, X, AlertCircle, CheckCircle2, Camera, MapPin, Loader2, ShieldCheck, Bell, Clipboard } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  currentUser?: User;
  onClose: () => void;
}

type PermissionFeedback = {
  kind: 'success' | 'error' | 'info';
  text: string;
};

const permissionHelp = 'Si le navigateur ne propose plus de fenêtre, ouvrez les réglages du site ou de l’application installée pour réactiver cette autorisation.';

export const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, currentUser, onClose }) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [requesting, setRequesting] = useState<'camera' | 'gps' | 'notifications' | 'clipboard' | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [clipboardPermission, setClipboardPermission] = useState<PermissionState | 'prompt' | 'unsupported'>('prompt');
  const [permissionFeedback, setPermissionFeedback] = useState<PermissionFeedback | null>(null);

  const refreshPermissionStates = async () => {
    setNotificationPermission('Notification' in window ? Notification.permission : 'unsupported');
    if (!navigator.clipboard) { setClipboardPermission('unsupported'); return; }
    try {
      const result = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
      setClipboardPermission(result?.state || 'prompt');
    } catch { setClipboardPermission('prompt'); }
  };

  useEffect(() => { if (isOpen) void refreshPermissionStates(); }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass) return;
    if (!currentUser) return;

    const res = updateUserPassword(currentUser.id, oldPass, newPass);
    setIsError(!res.success);
    setMsg(res.message);

    if (res.success) {
      setOldPass('');
      setNewPass('');
      setTimeout(() => {
        setMsg('');
        onClose();
      }, 1500);
    }
  };

  const requestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionFeedback({ kind: 'error', text: 'La caméra n’est pas prise en charge par cet appareil ou ce navigateur.' });
      return;
    }

    setRequesting('camera');
    setPermissionFeedback({ kind: 'info', text: 'Demande d’autorisation caméra en cours…' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionFeedback({ kind: 'success', text: 'Caméra autorisée. Elle sera demandée uniquement lors des photos de pointage ou de preuve.' });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      const text = name === 'NotAllowedError' || name === 'SecurityError'
        ? `Caméra toujours refusée. ${permissionHelp}`
        : 'La caméra est indisponible pour le moment. Vérifiez qu’aucune autre application ne l’utilise.';
      setPermissionFeedback({ kind: 'error', text });
    } finally {
      setRequesting(null);
    }
  };

  const requestGpsPermission = () => {
    if (!navigator.geolocation) {
      setPermissionFeedback({ kind: 'error', text: 'Le GPS n’est pas pris en charge par cet appareil ou ce navigateur.' });
      return;
    }

    setRequesting('gps');
    setPermissionFeedback({ kind: 'info', text: 'Demande d’autorisation GPS en cours…' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermissionFeedback({
          kind: 'success',
          text: `GPS autorisé (précision d’environ ${Math.round(position.coords.accuracy || 0)} m).`,
        });
        setRequesting(null);
      },
      (error) => {
        const text = error.code === error.PERMISSION_DENIED
          ? `GPS toujours refusé. ${permissionHelp}`
          : error.code === error.TIMEOUT
            ? 'La demande GPS a expiré. Vérifiez que la localisation est activée puis réessayez.'
            : 'La position est indisponible pour le moment. Vérifiez votre réseau et réessayez.';
        setPermissionFeedback({ kind: 'error', text });
        setRequesting(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) { setPermissionFeedback({ kind: 'error', text: 'Les notifications ne sont pas prises en charge par cet appareil ou ce navigateur.' }); return; }
    setRequesting('notifications');
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      setPermissionFeedback(result === 'granted' ? { kind: 'success', text: 'Notifications autorisées. Les alertes de demandes de fonds pourront être affichées et signalées.' } : { kind: 'error', text: `Notifications non autorisées. ${permissionHelp}` });
    } finally { setRequesting(null); }
  };

  const requestClipboardPermission = async () => {
    if (!navigator.clipboard?.readText) { setClipboardPermission('unsupported'); setPermissionFeedback({ kind: 'error', text: 'Le presse-papier n’est pas disponible dans ce navigateur.' }); return; }
    setRequesting('clipboard');
    try {
      await navigator.clipboard.readText();
      setClipboardPermission('granted');
      setPermissionFeedback({ kind: 'success', text: 'Presse-papier autorisé. Les numéros de demandes de fonds pourront être copiés immédiatement.' });
    } catch {
      await refreshPermissionStates();
      setPermissionFeedback({ kind: 'error', text: `Presse-papier non autorisé. ${permissionHelp}` });
    } finally { setRequesting(null); }
  };

  const feedbackStyle = permissionFeedback?.kind === 'success'
    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
    : permissionFeedback?.kind === 'error'
      ? 'bg-red-950/50 border-red-500/40 text-red-300'
      : 'bg-cyan-950/50 border-cyan-400/30 text-cyan-100';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-pop" onClick={onClose}>
      <div className="modal-sheet relative w-full max-w-md text-center" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black uppercase text-red-500 tracking-wider mb-2">Sécuriser mon accès</h2>
        <p className="text-xs text-gray-400 mb-5 font-semibold">
          Compte: <b className="text-white">{currentUser?.name || 'Agent'}</b>
        </p>

        <section className="text-left rounded-[1.45rem] border border-white/10 bg-black/15 p-3.5 mb-5" aria-label="Autorisations de l’appareil">
          <div className="flex items-center gap-2 mb-3 px-1">
            <ShieldCheck className="w-4 h-4 text-cyan-300" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Autorisations de l’appareil</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Relancez la demande après un refus.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={requestCameraPermission}
              disabled={requesting !== null}
              className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-3 text-left transition-all hover:bg-cyan-400/15 active:scale-[0.98] disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-2">
                <Camera className="w-4 h-4 text-cyan-200" />
                {requesting === 'camera' && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-100" />}
              </span>
              <span className="block mt-2 text-[11px] font-black uppercase tracking-wide text-white">Autoriser caméra</span>
            </button>
            <button
              type="button"
              onClick={requestGpsPermission}
              disabled={requesting !== null}
              className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-left transition-all hover:bg-amber-400/15 active:scale-[0.98] disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-2">
                <MapPin className="w-4 h-4 text-amber-200" />
                {requesting === 'gps' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-100" />}
              </span>
              <span className="block mt-2 text-[11px] font-black uppercase tracking-wide text-white">Autoriser GPS</span>
            </button>
            <button type="button" onClick={() => void requestNotificationPermission()} disabled={requesting !== null || notificationPermission === 'granted'} className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] disabled:cursor-default ${notificationPermission === 'granted' ? 'border-white/10 bg-white/[0.04] text-gray-500' : 'border-fuchsia-300/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/15 text-fuchsia-100'}`}><span className="flex items-center justify-between gap-2"><Bell className="w-4 h-4"/>{requesting === 'notifications' ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <span className={`relative h-5 w-9 rounded-full transition ${notificationPermission === 'granted' ? 'bg-gray-600' : 'bg-fuchsia-400/50'}`}><i className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${notificationPermission === 'granted' ? 'left-4' : 'left-0.5'}`}/></span>}</span><span className="block mt-2 text-[11px] font-black uppercase tracking-wide">Notifications</span><span className="mt-0.5 block text-[9px] font-bold opacity-65">{notificationPermission === 'granted' ? 'Déjà autorisées' : 'Appuyer pour autoriser'}</span></button>
            <button type="button" onClick={() => void requestClipboardPermission()} disabled={requesting !== null || clipboardPermission === 'granted'} className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] disabled:cursor-default ${clipboardPermission === 'granted' ? 'border-white/10 bg-white/[0.04] text-gray-500' : 'border-emerald-300/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-100'}`}><span className="flex items-center justify-between gap-2"><Clipboard className="w-4 h-4"/>{requesting === 'clipboard' ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <span className={`relative h-5 w-9 rounded-full transition ${clipboardPermission === 'granted' ? 'bg-gray-600' : 'bg-emerald-400/50'}`}><i className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${clipboardPermission === 'granted' ? 'left-4' : 'left-0.5'}`}/></span>}</span><span className="block mt-2 text-[11px] font-black uppercase tracking-wide">Presse-papier</span><span className="mt-0.5 block text-[9px] font-bold opacity-65">{clipboardPermission === 'granted' ? 'Déjà autorisé' : 'Appuyer pour autoriser'}</span></button>
          </div>
          {permissionFeedback && (
            <div className={`mt-3 rounded-2xl border px-3 py-2.5 text-[11px] font-semibold leading-relaxed ${feedbackStyle}`}>
              {permissionFeedback.text}
            </div>
          )}
        </section>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
            placeholder="Ancienne clé de sécurité"
            required
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 font-semibold"
          />

          <input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Nouvelle clé de sécurité (min. 4 car.)"
            required
            minLength={4}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 font-semibold"
          />

          {msg && (
            <div className={`p-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center space-x-2 ${
              isError ? 'bg-red-950/50 border border-red-500/40 text-red-400' : 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-400'
            }`}>
              {isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{msg}</span>
            </div>
          )}

          <button type="submit" className="btn-neon btn-red w-full">
            <Lock className="w-4 h-4" />
            <span>Mettre à jour ma clé</span>
          </button>
        </form>
      </div>
    </div>
  );
};
