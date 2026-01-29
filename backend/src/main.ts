import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import type { NextFunction, Request, Response } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url?.startsWith("/auth/telegram-webapp")) {
      console.log(`[auth] ${req.method} ${req.url}`);
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const allowedOrigins = new Set([
    "https://app.fundory.cc",
    "https://web.telegram.org",
    "http://localhost:3000",
    "http://localhost:3001",
  ]);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
  await app.listen(process.env.PORT || 3001);
}

bootstrap();
