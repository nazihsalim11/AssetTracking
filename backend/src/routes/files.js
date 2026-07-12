const multer = require('multer');
const storage = require('../../storage');

// Files are buffered in memory, then handed to storage.js, which puts them in a
// private Supabase bucket (or on local disk when Supabase is not configured).
// Writing to the container's disk would not survive a redeploy.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// File upload API — uploads and short-lived signed read URLs. Extracted verbatim
// from server.js. Uploads write into the storage bucket, so they require a
// signed-in user; the bucket is private, so reads go through a signed URL.
function register(app, { requireUser }) {
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const filePath = await storage.saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.json({
        name: req.file.originalname,
        fileName: filePath.split('/').pop(),
        fileSize: `${(req.file.size / 1024).toFixed(1)} KB`,
        fileUrl: filePath
      });
    } catch (err) {
      console.error('File upload failed:', err);
      res.status(500).json({ error: err.message || 'File upload failed' });
    }
  });

  // Mints a short-lived link to a stored file. Because the bucket is private, this
  // is the only way to read one — and it requires authentication.
  app.post('/api/files/signed-url', async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;

    const filePath = req.body?.path;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'A file path is required' });
    }

    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const url = await storage.getSignedUrl(filePath, baseUrl);
      res.json({ url, expiresIn: storage.SIGNED_URL_TTL_SECONDS });
    } catch (err) {
      console.error('Could not sign file URL:', err);
      res.status(404).json({ error: err.message || 'File is not available' });
    }
  });
}

module.exports = { register };
