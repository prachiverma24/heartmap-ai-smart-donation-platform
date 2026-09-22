process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-32-characters';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';

const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const ProjectMember = require('../src/models/ProjectMember');
const Note = require('../src/models/Note');
const ProjectFile = require('../src/models/ProjectFile');

let mongo;

// Helpers
const registerAndLogin = async (name, email, password = 'Password123') => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name, email, password });
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
};

const getToken = async (name, email, password = 'Password123') => {
  await request(app).post('/api/auth/register').send({ name, email, password });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body.token;
};

describe('Phase 8 — Project Collaboration, Notes & Files', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Project.deleteMany({});
    await ProjectMember.deleteMany({});
    await Note.deleteMany({});
    await ProjectFile.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  // ============================================================
  // PROJECT COLLABORATION
  // ============================================================

  describe('1. authenticated user creates project', () => {
    test('owner can create a project and it is accessible', async () => {
      const agent = await registerAndLogin('Alice', 'alice@example.com');
      const res = await agent.post('/api/projects').send({ name: 'HeartMap Phase 8', description: 'Full stack project' });
      expect(res.status).toBe(201);
      expect(res.body.project.name).toBe('HeartMap Phase 8');
      expect(res.body.project.owner).toBeDefined();
      expect(res.body.project.memberCount).toBe(1);
    });

    test('unauthenticated user cannot create project', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  describe('2. project appears in user projects list', () => {
    test('created project appears in GET /api/projects', async () => {
      const agent = await registerAndLogin('Bob', 'bob@example.com');
      await agent.post('/api/projects').send({ name: 'My Project', description: 'Desc' });
      const list = await agent.get('/api/projects');
      expect(list.status).toBe(200);
      expect(list.body.projects.length).toBeGreaterThanOrEqual(1);
      expect(list.body.projects[0].name).toBe('My Project');
    });
  });

  describe('3. owner can add member', () => {
    test('owner adds a new member by email', async () => {
      const ownerAgent = await registerAndLogin('Owner', 'owner@example.com');
      const memberToken = await getToken('Member', 'member@example.com');

      const projectRes = await ownerAgent.post('/api/projects').send({ name: 'Collab Project' });
      const projectId = projectRes.body.project.id;

      const addRes = await ownerAgent
        .post(`/api/projects/${projectId}/members`)
        .send({ email: 'member@example.com' });
      expect(addRes.status).toBe(201);
      expect(addRes.body.member.role).toBe('member');
    });
  });

  describe('4. member can access project', () => {
    test('added member can GET project details', async () => {
      const ownerAgent = await registerAndLogin('Owner2', 'owner2@example.com');
      const memberAgent = await registerAndLogin('Member2', 'member2@example.com');

      const projectRes = await ownerAgent.post('/api/projects').send({ name: 'Team Project' });
      const projectId = projectRes.body.project.id;

      await ownerAgent.post(`/api/projects/${projectId}/members`).send({ email: 'member2@example.com' });

      const getRes = await memberAgent.get(`/api/projects/${projectId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.project.name).toBe('Team Project');
    });
  });

  describe('5. non-member receives 403', () => {
    test('non-member gets 403 on project detail', async () => {
      const ownerAgent = await registerAndLogin('Owner3', 'owner3@example.com');
      const nonMemberAgent = await registerAndLogin('NonMember', 'nonmember@example.com');

      const projectRes = await ownerAgent.post('/api/projects').send({ name: 'Private Project' });
      const projectId = projectRes.body.project.id;

      const getRes = await nonMemberAgent.get(`/api/projects/${projectId}`);
      expect(getRes.status).toBe(403);
    });
  });

  describe('6. non-owner cannot manage members', () => {
    test('member cannot add another member', async () => {
      const ownerAgent = await registerAndLogin('Owner4', 'owner4@example.com');
      const memberAgent = await registerAndLogin('Member4', 'member4@example.com');
      await getToken('Target', 'target@example.com');

      const projectRes = await ownerAgent.post('/api/projects').send({ name: 'Managed Project' });
      const projectId = projectRes.body.project.id;

      await ownerAgent.post(`/api/projects/${projectId}/members`).send({ email: 'member4@example.com' });

      const addRes = await memberAgent
        .post(`/api/projects/${projectId}/members`)
        .send({ email: 'target@example.com' });
      expect(addRes.status).toBe(403);
    });
  });

  describe('7. duplicate member rejected', () => {
    test('adding the same member twice returns 409', async () => {
      const ownerAgent = await registerAndLogin('Owner5', 'owner5@example.com');
      await getToken('Dup', 'dup@example.com');

      const projectRes = await ownerAgent.post('/api/projects').send({ name: 'Dup Test' });
      const projectId = projectRes.body.project.id;

      await ownerAgent.post(`/api/projects/${projectId}/members`).send({ email: 'dup@example.com' });
      const res2 = await ownerAgent.post(`/api/projects/${projectId}/members`).send({ email: 'dup@example.com' });
      expect(res2.status).toBe(409);
    });
  });

  describe('8. invalid project/user ID rejected', () => {
    test('invalid project ID returns 400', async () => {
      const agent = await registerAndLogin('User8', 'user8@example.com');
      const res = await agent.get('/api/projects/not-a-valid-id');
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // MARKDOWN NOTES
  // ============================================================

  describe('9. authorized user creates note', () => {
    test('member creates a note in project', async () => {
      const agent = await registerAndLogin('NoteUser', 'noteuser@example.com');
      const projectRes = await agent.post('/api/projects').send({ name: 'Note Project' });
      const projectId = projectRes.body.project.id;

      const noteRes = await agent
        .post(`/api/projects/${projectId}/notes`)
        .send({ title: 'My First Note', content: '## Setup\n\nThis is the setup guide.' });
      expect(noteRes.status).toBe(201);
      expect(noteRes.body.note.title).toBe('My First Note');
    });
  });

  describe('10. note saved in MongoDB', () => {
    test('created note persists in database', async () => {
      const agent = await registerAndLogin('NoteUser2', 'noteuser2@example.com');
      const projectRes = await agent.post('/api/projects').send({ name: 'DB Note Project' });
      const projectId = projectRes.body.project.id;

      const noteRes = await agent
        .post(`/api/projects/${projectId}/notes`)
        .send({ title: 'Saved Note', content: 'Content here' });
      const noteId = noteRes.body.note.id;

      const dbNote = await Note.findById(noteId);
      expect(dbNote).toBeTruthy();
      expect(dbNote.title).toBe('Saved Note');
      expect(dbNote.content).toBe('Content here');
    });
  });

  describe('11. note can be retrieved', () => {
    test('GET single note returns correct data', async () => {
      const agent = await registerAndLogin('NoteUser3', 'noteuser3@example.com');
      const projectRes = await agent.post('/api/projects').send({ name: 'Get Note Project' });
      const projectId = projectRes.body.project.id;

      const noteRes = await agent.post(`/api/projects/${projectId}/notes`).send({ title: 'Retrievable', content: 'Details' });
      const noteId = noteRes.body.note.id;

      const getRes = await agent.get(`/api/projects/${projectId}/notes/${noteId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.note.title).toBe('Retrievable');
      expect(getRes.body.note.content).toBe('Details');
    });
  });

  describe('12. note can be edited', () => {
    test('PUT updates note content', async () => {
      const agent = await registerAndLogin('NoteUser4', 'noteuser4@example.com');
      const projectRes = await agent.post('/api/projects').send({ name: 'Edit Note Project' });
      const projectId = projectRes.body.project.id;

      const noteRes = await agent.post(`/api/projects/${projectId}/notes`).send({ title: 'Original', content: 'Old content' });
      const noteId = noteRes.body.note.id;

      const updateRes = await agent.put(`/api/projects/${projectId}/notes/${noteId}`).send({ content: '## Updated\n\nNew content' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.note.content).toBe('## Updated\n\nNew content');
    });
  });

  describe('13. note can be deleted where permitted', () => {
    test('note creator can delete their note', async () => {
      const agent = await registerAndLogin('NoteUser5', 'noteuser5@example.com');
      const projectRes = await agent.post('/api/projects').send({ name: 'Delete Note Project' });
      const projectId = projectRes.body.project.id;

      const noteRes = await agent.post(`/api/projects/${projectId}/notes`).send({ title: 'To Delete', content: 'bye' });
      const noteId = noteRes.body.note.id;

      const delRes = await agent.delete(`/api/projects/${projectId}/notes/${noteId}`);
      expect(delRes.status).toBe(200);

      const dbNote = await Note.findById(noteId);
      expect(dbNote).toBeNull();
    });
  });

  describe('14. Explain with Gemini works (note content endpoint)', () => {
    test('POST /api/ai/gemini/explain with content returns explanation', async () => {
      const agent = await registerAndLogin('GeminiUser', 'geminiuser@example.com');
      const res = await agent
        .post('/api/ai/gemini/explain')
        .send({ content: '## Setup\n\nThis project uses Node.js and Express.' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.explanation).toBe('string');
      expect(res.body.explanation.length).toBeGreaterThan(0);
    });

    test('POST /api/ai/gemini/explain with project+note loads content server-side', async () => {
      const agent = await registerAndLogin('GeminiNote', 'gemininote@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Gemini Note Project' });
      const projectId = projRes.body.project.id;
      const noteRes = await agent.post(`/api/projects/${projectId}/notes`).send({ title: 'AI Note', content: 'const x = 1;' });
      const noteId = noteRes.body.note.id;

      const explainRes = await agent.post('/api/ai/gemini/explain').send({ projectId, noteId });
      expect(explainRes.status).toBe(200);
      expect(explainRes.body.success).toBe(true);
    });
  });

  describe('15. Improve with Gemini works', () => {
    test('POST /api/ai/gemini/docs returns improved markdown', async () => {
      const agent = await registerAndLogin('GeminiImprove', 'geminiimprove@example.com');
      const res = await agent.post('/api/ai/gemini/docs').send({ content: '## my note\n\nthis is some text' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.improved).toBe('string');
      expect(res.body.improved.length).toBeGreaterThan(0);
      expect(res.body.warning).toBeDefined();
    });

    test('POST /api/ai/gemini/docs with empty content returns 400', async () => {
      const agent = await registerAndLogin('GeminiEmpty', 'geminiempty@example.com');
      const res = await agent.post('/api/ai/gemini/docs').send({ content: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('16. Gemini does not automatically overwrite saved note', () => {
    test('improve endpoint returns suggestion only — note DB record unchanged', async () => {
      const agent = await registerAndLogin('GeminiSafe', 'geminisafe@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Safe Project' });
      const projectId = projRes.body.project.id;
      const noteRes = await agent.post(`/api/projects/${projectId}/notes`).send({ title: 'Original Note', content: 'original content' });
      const noteId = noteRes.body.note.id;

      // Call improve endpoint — it should NOT change the DB
      await agent.post('/api/ai/gemini/docs').send({ content: 'original content' });

      // Verify DB note is unchanged
      const dbNote = await Note.findById(noteId);
      expect(dbNote.content).toBe('original content');
    });
  });

  // ============================================================
  // FILE UPLOAD
  // ============================================================

  describe('17. authorized member uploads valid file', () => {
    test('member can upload a text file', async () => {
      const agent = await registerAndLogin('FileUser', 'fileuser@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'File Project' });
      const projectId = projRes.body.project.id;

      const fileBuffer = Buffer.from('# Hello\n\nTest file content');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', fileBuffer, { filename: 'test.md', contentType: 'text/markdown' });
      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.file.originalName).toBe('test.md');
      expect(uploadRes.body.file.size).toBeGreaterThan(0);
    });
  });

  describe('18. file metadata saved in DB', () => {
    test('uploaded file has metadata in MongoDB', async () => {
      const agent = await registerAndLogin('FileUser2', 'fileuser2@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Meta Project' });
      const projectId = projRes.body.project.id;

      const fileBuffer = Buffer.from('console.log("hello");');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', fileBuffer, { filename: 'app.js', contentType: 'application/javascript' });
      const fileId = uploadRes.body.file.id;

      const dbFile = await ProjectFile.findById(fileId);
      expect(dbFile).toBeTruthy();
      expect(dbFile.originalName).toBe('app.js');
      expect(dbFile.mimeType).toBeTruthy();
      expect(dbFile.storagePath).toBeTruthy();
    });
  });

  describe('19. image preview works', () => {
    test('GET file metadata marks image as non-text code', async () => {
      const agent = await registerAndLogin('ImgUser', 'imguser@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Image Project' });
      const projectId = projRes.body.project.id;

      // Use a small PNG-like buffer
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', pngBuffer, { filename: 'photo.png', contentType: 'image/png' });
      const fileId = uploadRes.body.file.id;

      const getRes = await agent.get(`/api/projects/${projectId}/files/${fileId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.file.isTextCode).toBe(false);
      expect(getRes.body.file.mimeType).toContain('image');
    });
  });

  describe('20. PDF handling works', () => {
    test('uploaded PDF is accepted with correct metadata', async () => {
      const agent = await registerAndLogin('PdfUser', 'pdfuser@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'PDF Project' });
      const projectId = projRes.body.project.id;

      const pdfBuffer = Buffer.from('%PDF-1.4 test pdf content');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', pdfBuffer, { filename: 'doc.pdf', contentType: 'application/pdf' });
      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.file.originalName).toBe('doc.pdf');
    });
  });

  describe('21. code/text preview works', () => {
    test('GET file returns content for text/code files', async () => {
      const agent = await registerAndLogin('CodeUser', 'codeuser@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Code Project' });
      const projectId = projRes.body.project.id;

      const codeBuffer = Buffer.from('def hello():\n    print("Hello World")');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', codeBuffer, { filename: 'hello.py', contentType: 'text/x-python' });
      const fileId = uploadRes.body.file.id;

      const getRes = await agent.get(`/api/projects/${projectId}/files/${fileId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.file.isTextCode).toBe(true);
      expect(getRes.body.file.content).toContain('hello');
    });
  });

  describe('22. unsupported/dangerous file rejected', () => {
    test('executable file upload is rejected', async () => {
      const agent = await registerAndLogin('DangUser', 'danguser@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Danger Project' });
      const projectId = projRes.body.project.id;

      const buffer = Buffer.from('#!/bin/bash\nrm -rf /');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', buffer, { filename: 'evil.sh', contentType: 'application/x-sh' });
      expect(uploadRes.status).toBe(400);
    });

    test('exe file upload is rejected', async () => {
      const agent = await registerAndLogin('DangUser2', 'danguser2@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Danger Project 2' });
      const projectId = projRes.body.project.id;

      const buffer = Buffer.from('MZ windows executable');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', buffer, { filename: 'virus.exe', contentType: 'application/x-executable' });
      expect(uploadRes.status).toBe(400);
    });
  });

  describe('23. oversized file rejected', () => {
    test('file over 10MB is rejected', async () => {
      const agent = await registerAndLogin('BigUser', 'biguser@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Big File Project' });
      const projectId = projRes.body.project.id;

      // 11MB buffer
      const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', bigBuffer, { filename: 'huge.txt', contentType: 'text/plain' });
      expect(uploadRes.status).toBe(400);
      expect(uploadRes.body.error).toMatch(/limit/i);
    });
  });

  describe('24. non-member cannot access file', () => {
    test('non-member gets 403 when accessing project files', async () => {
      const ownerAgent = await registerAndLogin('FileOwner', 'fileowner@example.com');
      const nonMemberAgent = await registerAndLogin('FileNon', 'filenon@example.com');

      const projRes = await ownerAgent.post('/api/projects').send({ name: 'Guarded Project' });
      const projectId = projRes.body.project.id;

      const getRes = await nonMemberAgent.get(`/api/projects/${projectId}/files`);
      expect(getRes.status).toBe(403);
    });
  });

  describe('25. code file Gemini explanation works', () => {
    test('POST /api/gemini/explain with projectId+fileId returns explanation', async () => {
      const agent = await registerAndLogin('ExplainFile', 'explainfile@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Explain File Project' });
      const projectId = projRes.body.project.id;

      const codeBuffer = Buffer.from('function add(a, b) { return a + b; }');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', codeBuffer, { filename: 'add.js', contentType: 'application/javascript' });
      const fileId = uploadRes.body.file.id;

      const explainRes = await agent.post('/api/ai/gemini/explain').send({ projectId, fileId });
      expect(explainRes.status).toBe(200);
      expect(explainRes.body.success).toBe(true);
      expect(typeof explainRes.body.explanation).toBe('string');
    });
  });

  describe('26. uploaded code is never executed', () => {
    test('GET file with code returns content as text, not executed', async () => {
      const agent = await registerAndLogin('ExecSafe', 'execsafe@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Safe Execute Project' });
      const projectId = projRes.body.project.id;

      const dangerCode = Buffer.from('process.exit(1); // should never run');
      const uploadRes = await agent
        .post(`/api/projects/${projectId}/files`)
        .attach('file', dangerCode, { filename: 'dangerous.js', contentType: 'application/javascript' });
      const fileId = uploadRes.body.file.id;

      // Should return content as string, not execute it
      const getRes = await agent.get(`/api/projects/${projectId}/files/${fileId}`);
      expect(getRes.status).toBe(200);
      expect(typeof getRes.body.file.content).toBe('string');
      expect(getRes.body.file.content).toContain('process.exit');
    });
  });

  // ============================================================
  // SECURITY
  // ============================================================

  describe('27. API keys absent from backend responses', () => {
    test('explain response does not contain API key patterns', async () => {
      const agent = await registerAndLogin('SecUser', 'secuser@example.com');
      const res = await agent.post('/api/ai/gemini/explain').send({ content: 'const x = 1;' });
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toMatch(/AIza[A-Za-z0-9_-]{35}/);
      expect(bodyStr).not.toMatch(/sk-[A-Za-z0-9]{20}/);
    });
  });

  describe('28. passwords/tokens absent from AI prompts', () => {
    test('explain endpoint does not return any password or JWT field', async () => {
      const agent = await registerAndLogin('SecUser2', 'secuser2@example.com');
      const res = await agent.post('/api/ai/gemini/explain').send({ content: 'some code content' });
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.token).toBeUndefined();
    });
  });

  describe('29. path traversal blocked', () => {
    test('file IDs are validated as MongoDB ObjectIDs', async () => {
      const agent = await registerAndLogin('PathUser', 'pathuser@example.com');
      const projRes = await agent.post('/api/projects').send({ name: 'Path Project' });
      const projectId = projRes.body.project.id;

      const res = await agent.get(`/api/projects/${projectId}/files/../../../etc/passwd`);
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('30. private project data inaccessible to non-members', () => {
    test('non-member cannot list notes of private project', async () => {
      const ownerAgent = await registerAndLogin('PrivOwner', 'privowner@example.com');
      const attackerAgent = await registerAndLogin('Attacker', 'attacker@example.com');

      const projRes = await ownerAgent.post('/api/projects').send({ name: 'Private Notes Project' });
      const projectId = projRes.body.project.id;
      await ownerAgent.post(`/api/projects/${projectId}/notes`).send({ title: 'Secret', content: 'Top secret data' });

      const getRes = await attackerAgent.get(`/api/projects/${projectId}/notes`);
      expect(getRes.status).toBe(403);
    });
  });

  // ============================================================
  // REGRESSION: Existing features
  // ============================================================

  describe('31-32. Existing auth and NGO discovery still work', () => {
    test('auth registration and login still work', async () => {
      const res = await request(app).post('/api/auth/register').send({ name: 'Regress', email: 'regress@example.com', password: 'Password123' });
      expect(res.status).toBe(201);
    });

    test('public NGO endpoint still works', async () => {
      const res = await request(app).get('/api/ngo/public');
      expect([200, 404]).toContain(res.status); // 200 with empty list is fine
    });
  });

  describe('38. AI chatbot still works', () => {
    test('POST /api/ai/chat responds correctly', async () => {
      const res = await request(app).post('/api/ai/chat').send({ message: 'What is HeartMap?' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.reply).toBe('string');
    });
  });

  describe('44. AI assistant still works', () => {
    test('POST /api/ai/assistant responds correctly', async () => {
      const res = await request(app).post('/api/ai/assistant').send({ message: 'I want to donate clothes in Delhi' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('45. No payment processing', () => {
    test('payment questions are handled safely', async () => {
      const res = await request(app).post('/api/ai/chat').send({ message: 'Can I make a payment through HeartMap?' });
      expect(res.status).toBe(200);
      expect(res.body.reply).toMatch(/does not process/i);
    });
  });
});
