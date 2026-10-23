import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useToast } from '../components/Toast';
import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';

export const ProfilePage: React.FC = () => {
  const { user, signOut, updateProfile, isAdmin, setDemoUser } = useAuth();
  const { uploadMedia, isUploading } = useMediaUpload();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const handleCopyUsername = () => {
    if (user?.username) {
      navigator.clipboard.writeText(`@${user.username}`);
      toast(`Copied @${user.username} to clipboard!`, 'success');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const { error } = await updateProfile({
      display_name: displayName.trim() || user.username || 'User',
      bio: bio.slice(0, 100),
    });
    setIsSaving(false);

    if (error) {
      toast('Failed to update profile', 'error');
    } else {
      toast('Profile updated successfully!', 'success');
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    toast('Uploading profile picture…', 'info');
    const result = await uploadMedia(file, 'avatar', 'avatar.jpg');

    if (result) {
      const newAvatar = result.url || result.object_key;
      await updateProfile({ avatar_url: newAvatar });
      toast('Profile picture updated!', 'success');
    } else {
      toast('Failed to upload picture', 'error');
    }
  };

  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('inspire_theme', isDark ? 'dark' : 'light');
    toast(`Switched to ${isDark ? 'Dark' : 'Light'} theme`, 'info');
  };

  const handleLogout = async () => {
    await signOut();
    toast('Logged out successfully', 'info');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] text-black dark:text-white pb-24">
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarFile}
        accept="image/*"
        className="hidden"
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A3348] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-black dark:text-white">
            My Profile
          </h1>
          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-colors"
            title="Toggle Theme"
            aria-label="Toggle dark mode"
          >
            🌓
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Avatar Card */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <Avatar
              name={user?.display_name || user?.username || 'You'}
              avatarUrl={user?.avatar_url}
              size="xl"
            />
            <div className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
              {isUploading ? '…' : 'Change'}
            </div>
          </div>

          <h2 className="text-xl font-black text-black dark:text-white mt-3">
            {user?.display_name || 'Anonymous User'}
          </h2>

          {/* Username badge with copy button */}
          <div className="mt-1 flex items-center space-x-1.5 bg-[#F5F7FA] dark:bg-[#161B2B] px-3 py-1 rounded-full border border-[#E5E7EB] dark:border-[#2A3348]">
            <span className="text-xs font-bold text-[#0E2A6E] dark:text-[#3D6FE0]">
              @{user?.username || 'set_username'}
            </span>
            <button
              onClick={handleCopyUsername}
              className="text-xs text-gray-400 hover:text-black dark:hover:text-white p-0.5"
              title="Copy ID to share"
              aria-label="Copy Username"
            >
              📋
            </button>
          </div>

          {isAdmin && (
            <span className="mt-2 px-2.5 py-0.5 rounded-full bg-[#FFD700] text-[#1A1A2E] text-[10px] font-black uppercase tracking-wider shadow-xs">
              Platform Admin
            </span>
          )}
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4 bg-white dark:bg-[#161B2B] p-5 rounded-3xl border border-[#E5E7EB] dark:border-[#2A3348] shadow-sm mb-6">
          <h3 className="font-extrabold text-sm text-black dark:text-white">
            Edit Information
          </h3>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              maxLength={40}
              required
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-black dark:text-gray-200">
                Bio / About
              </label>
              <span className="text-[10px] text-gray-400 font-bold">
                {bio.length}/100
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 100))}
              placeholder="Tell friends what you're up to…"
              rows={2}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F5F7FA] dark:bg-[#1A2234] border border-[#E5E7EB] dark:border-[#2A3348] text-black dark:text-white font-medium text-sm focus:outline-none focus:border-[#0E2A6E]"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 px-4 rounded-2xl bg-[#0E2A6E] text-white font-extrabold text-xs hover:bg-[#081B47] active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            {isSaving ? 'Saving changes…' : 'Save Changes'}
          </button>
        </form>

        {/* Administration link for Admins */}
        {isAdmin && (
          <div className="mb-6 p-4 rounded-3xl bg-[#FFD700]/15 border border-[#FFD700]/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <h4 className="font-extrabold text-xs text-[#1A1A2E] dark:text-[#FFD700]">
                  Admin Operations Console
                </h4>
                <p className="text-[11px] text-[#4B5563] dark:text-gray-300">
                  Manage users, moderation reports, analytics & settings
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="px-3.5 py-2 rounded-xl bg-[#0E2A6E] text-white text-xs font-extrabold hover:bg-[#081B47] shadow-sm"
            >
              Open
            </Link>
          </div>
        )}

        {/* App Settings and Legal disclosure */}
        <div className="space-y-2 mb-6">
          <button
            type="button"
            onClick={() => setShowPrivacyPolicy(true)}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>📄</span>
              <span>Privacy Policy & Safety Transparency</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Switch persona demo button for fast testing */}
          <button
            type="button"
            onClick={() => {
              if (isAdmin) {
                setDemoUser('user');
                toast('Switched to User profile (@alex_dev)', 'info');
              } else {
                setDemoUser('admin');
                toast('Switched to Admin profile (Sarah)', 'info');
              }
            }}
            className="w-full p-4 rounded-2xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🔄</span>
              <span>
                Switch to {isAdmin ? 'Standard User' : 'Admin'} Mode
              </span>
            </div>
            <span className="text-gray-400">Toggle</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-left"
          >
            <div className="flex items-center space-x-2.5">
              <span>🚪</span>
              <span>Log Out</span>
            </div>
            <span>→</span>
          </button>
        </div>
      </main>

      {/* Privacy Policy Disclosure Modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl max-h-[80vh] overflow-y-auto animate-slide-up">
            <h3 className="font-extrabold text-base text-black dark:text-white mb-2">
              Privacy Policy & Moderation Audit Transparency
            </h3>
            <div className="text-xs text-[#4B5563] dark:text-[#9CA3AF] space-y-3 leading-relaxed mb-6">
              <p>
                <strong>Security in Transit & at Rest:</strong> All messages, voice notes, and media on Inspire are encrypted in transit over modern TLS and stored securely in certified cloud databases.
              </p>
              <p>
                <strong>Safety & Content Moderation:</strong> To protect users from harassment, exploitation, and abuse, authorized Inspire Administrators have access to review reported conversations.
              </p>
              <p>
                <strong>Strict Immutable Audit Logging:</strong> In accordance with our security principles, every access to a user conversation history by an administrator is automatically recorded to an immutable, append-only security log (<code className="font-mono text-[10px]">admin_audit_log</code>), recording administrator identity, target conversation, and precise timestamp.
              </p>
            </div>
            <button
              onClick={() => setShowPrivacyPolicy(false)}
              className="w-full py-2.5 rounded-2xl bg-[#0E2A6E] text-white text-xs font-bold hover:bg-[#081B47]"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav totalUnread={0} isAdmin={isAdmin} />
    </div>
  );
};
