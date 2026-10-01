import 'dotenv/config';
import {z} from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().min(1000).max(65535).default(8080),
    APP_ORIGIN: z.string().default('http://localhost:5173'),
    DATABASE_PATH: z.string().default('./data/reunite.sqlite'),
    UPLOADS_DIR: z.string().default('./data/uploads'),
    VITE_MAPBOX_ACCESS_TOKEN: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('VIT Reunite <no-reply@vitstudent.ac.in>'),
    ADMIN_EMAILS: z.string().default(''),
    DEV_AUTO_VERIFY: z
      .preprocess(
        val => (val === 'true' || val === true ? true : false),
        z.boolean()
      )
      .default(false),
    TRUST_PROXY: z
      .preprocess(
        val => (val === 'true' || val === true ? true : false),
        z.boolean()
      )
      .default(false),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.DEV_AUTO_VERIFY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DEV_AUTO_VERIFY'],
          message: 'DEV_AUTO_VERIFY must never be enabled in production.',
        });
      }
      if (!data.SMTP_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: 'Production requires SMTP_HOST for email verification.',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration validation failed:');
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  isDev: parsed.data.NODE_ENV === 'development',
  adminEmails: parsed.data.ADMIN_EMAILS.split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
  origin: parsed.data.APP_ORIGIN.trim().replace(/\/$/, ''),
};
