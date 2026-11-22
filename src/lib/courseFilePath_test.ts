import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseFilePath } from './courseFilePath.ts';

const BASE = 'https://ynooatjtgstgwfssnira.supabase.co/storage/v1/object';

test('old public course-file links map to their private storage path', () => {
  assert.equal(
    courseFilePath(`${BASE}/public/course-files/2d31d834-e497-4559-8d6b-cb139e95e368/1766304425491-Dm%20the%20word%20(Endscreen).jpg`),
    '2d31d834-e497-4559-8d6b-cb139e95e368/1766304425491-Dm the word (Endscreen).jpg',
  );
});

test('signed links resolve to the same path, so deleting or re-saving never stores an expiring link', () => {
  assert.equal(
    courseFilePath(`${BASE}/sign/course-files/shared-marketing/1747200008-hair-patch.png?token=abc.def`),
    'shared-marketing/1747200008-hair-patch.png',
  );
});

test('files outside the course-files folder are left alone', () => {
  assert.equal(courseFilePath('/lesson-assets/posts/hair-system-vertical.mp4'), null);
  assert.equal(courseFilePath(`${BASE}/public/certificates/fonts/CertificateName.ttf`), null);
  assert.equal(courseFilePath(null), null);
});
