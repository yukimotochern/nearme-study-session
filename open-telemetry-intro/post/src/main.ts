import '@nearme-study-session/open-telemetry-intro-instrumentation';
import express from 'express';
import { PrismaClient } from '@prisma-clients/post';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import axios from 'axios';

const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
app.use(pinoHttp());

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

app.get('/', async (req, res) => {
  try {
    req.log.info(
      {
        password: req.query['password'],
        email: req.query['email'],
        title: req.query['title'],
      },
      'headers'
    );
    const password = z.string().parse(req.query['password']);
    const email = z.string().parse(req.query['email']);
    const title = z.string().parse(req.query['title']);
    const userApiUrl = process.env.USER_API_URL;
    if (!userApiUrl) throw new Error('no');
    const { data } = await axios.get(userApiUrl, {
      params: {
        password,
        email,
      },
    });
    req.log.info(data, 'data from user api');
    const { ok, userId } = z
      .object({ ok: z.boolean(), userId: z.optional(z.number()) })
      .parse(data);
    if (!ok) {
      req.log.error(data, 'no access');
      res.status(403).send({
        message: 'No access',
      });
      return;
    }
    req.log.info({ title, userId }, 'post data');
    const post = await prisma.post.create({
      data: {
        title,
        authorId: userId || 0,
      },
    });
    req.log.info(post, 'post created');
    res.send({ post });
  } catch (error) {
    req.log.error(error, 'server error');
    console.log(error);
    res.status(500).send(error);
  }
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
