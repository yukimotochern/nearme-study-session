import '@nearme-study-session/open-telemetry-intro-instrumentation';
import { z } from 'zod';
import express from 'express';
import { PrismaClient } from '@prisma-clients/user';
import { pinoHttp } from 'pino-http';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(pinoHttp());

const seeding = async () => {
  const users = await prisma.user.findMany();
  if (users.length === 0) {
    await prisma.user.createMany({
      data: [
        {
          id: 1,
          password: 'password1',
          email: 'user1@example.com',
        },
      ],
    });
  }
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

app.get('/', async (req, res) => {
  try {
    await seeding();
    req.log.info(
      {
        password: req.query['password'],
        email: req.query['email'],
      },
      'headers'
    );
    const password = z.string().parse(req.query['password']);
    const email = z.string().parse(req.query['email']);
    const users = await prisma.user.findMany({
      where: {
        email,
        password,
      },
    });
    req.log.info(users, 'user created');
    res.send({ ok: users.length === 1, userId: users[0]?.id });
  } catch (error) {
    req.log.error(error, 'server error');
    console.log(error);
    res.status(500).send(error);
  }
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
