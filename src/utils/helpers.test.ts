import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidUsername,
  isMessageDeletedForViewer,
  validateMediaUpload,
  formatLastSeen,
  formatDuration,
} from './helpers';

test('username validation adheres to 3-20 lowercase alphanumeric + underscore', () => {
  assert.equal(isValidUsername('john_doe'), true);
  assert.equal(isValidUsername('alice123'), true);
  assert.equal(isValidUsername('a_b'), true);
  assert.equal(isValidUsername('ab'), false, 'too short');
  assert.equal(isValidUsername('User_Name'), false, 'no uppercase');
  assert.equal(isValidUsername('john-doe'), false, 'no dashes');
  assert.equal(isValidUsername('user@domain'), false, 'no symbols');
  assert.equal(isValidUsername('this_username_is_way_too_long_for_inspire'), false, 'too long');
});

test('per-viewer message deletion rules', () => {
  const msg = {
    sender_id: 'user_1',
    receiver_id: 'user_2',
    is_deleted_sender: true,
    is_deleted_receiver: false,
  };

  // Sender deleted for me -> should be deleted for sender, NOT for receiver
  assert.equal(isMessageDeletedForViewer(msg, 'user_1'), true);
  assert.equal(isMessageDeletedForViewer(msg, 'user_2'), false);

  const msgBoth = {
    sender_id: 'user_1',
    receiver_id: 'user_2',
    is_deleted_sender: true,
    is_deleted_receiver: true,
  };
  // Delete for everyone
  assert.equal(isMessageDeletedForViewer(msgBoth, 'user_1'), true);
  assert.equal(isMessageDeletedForViewer(msgBoth, 'user_2'), true);
});

test('media upload size limits', () => {
  assert.equal(validateMediaUpload('image', 5 * 1024 * 1024).valid, true);
  assert.equal(validateMediaUpload('image', 12 * 1024 * 1024).valid, false);
  assert.equal(validateMediaUpload('video', 40 * 1024 * 1024).valid, true);
  assert.equal(validateMediaUpload('video', 55 * 1024 * 1024).valid, false);
  assert.equal(validateMediaUpload('voice_note', 8 * 1024 * 1024).valid, true);
  assert.equal(validateMediaUpload('avatar', 6 * 1024 * 1024).valid, false);
});

test('formatDuration formats mm:ss correctly', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(45), '0:45');
  assert.equal(formatDuration(75), '1:15');
  assert.equal(formatDuration(360), '6:00');
});

test('formatLastSeen produces expected friendly strings', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  const justNow = new Date('2026-10-23T11:59:45Z').toISOString();
  const fiveMinAgo = new Date('2026-10-23T11:55:00Z').toISOString();

  assert.equal(formatLastSeen(justNow, now), 'Just now');
  assert.equal(formatLastSeen(fiveMinAgo, now), '5m ago');
});
