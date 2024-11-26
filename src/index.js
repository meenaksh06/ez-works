const express = require('express');
const prisma = require('@prisma/client');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const prismaClient = new prisma.PrismaClient();

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/file');

app.use('/auth', authRoutes(prismaClient));
app.use('/file', fileRoutes(prismaClient));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
