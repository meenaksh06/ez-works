const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

module.exports = (prisma) => {
  const router = require('express').Router();

  // Set up multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });

  const upload = multer({ storage });

  // Upload file route (only for Ops Users)
  router.post('/upload-file', upload.single('file'), async (req, res) => {
    const { userId } = req.body; // User ID from JWT payload
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user.role !== 'ops') {
      return res.status(403).json({ message: 'Permission denied' });
    }

    const file = req.file;
    const filePath = path.join(__dirname, '..', 'uploads', file.filename);
    const encryptedDownloadUrl = encryptUrl(file.filename, user.id);

    const newFile = await prisma.file.create({
      data: {
        filename: file.originalname,
        filePath,
        uploadedById: user.id,
        encryptedDownloadUrl,
      },
    });

    res.status(201).json({ message: 'File uploaded successfully', fileId: newFile.id });
  });

  // List files route (for Client Users)
  router.get('/list-files', async (req, res) => {
    const { userId } = req.body; // User ID from JWT payload
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user.role !== 'client') {
      return res.status(403).json({ message: 'Permission denied' });
    }

    const files = await prisma.file.findMany({ where: { uploadedById: user.id } });

    res.json({ files });
  });

  // Download file route (for Client Users only)
  router.get('/download-file/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const { userId } = req.body; // User ID from JWT payload

    const file = await prisma.file.findUnique({ where: { id: parseInt(fileId) } });
    if (!file || decryptUrl(file.encryptedDownloadUrl) !== `${file.id}:${userId}`) {
      return res.status(403).json({ message: 'Unauthorized access to the file' });
    }

    res.sendFile(file.filePath);
  });

  // Helper function to encrypt the download URL
  function encryptUrl(fileId, userId) {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.AES_SECRET), Buffer.alloc(16, 0));
    const encrypted = Buffer.concat([cipher.update(`${fileId}:${userId}`), cipher.final()]);
    return encrypted.toString('hex');
  }

  // Helper function to decrypt the URL
  function decryptUrl(encryptedUrl) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(process.env.AES_SECRET), Buffer.alloc(16, 0));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedUrl, 'hex')), decipher.final()]);
    return decrypted.toString();
  }

  return router;
};
