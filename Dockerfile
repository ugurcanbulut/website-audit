# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:22-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build
RUN npm run worker:build

# Stage 3: Install only runtime dynamic-import packages + tsx for the worker.
# Next.js' standalone build ships only what the web server imports statically;
# workers load Playwright et al. via dynamic import and need them added back.
# tsx is here because the worker entrypoint src/worker/index.ts runs as TS.
FROM node:22-slim AS runtime-deps
WORKDIR /deps

RUN echo '{"dependencies":{"playwright":"^1.50","bullmq":"^5","ioredis":"^5","postgres":"^3.4","@axe-core/playwright":"^4.11","lighthouse":"^13","htmlhint":"^1.9","@projectwallace/css-analyzer":"^9.6","sharp":"^0.33","drizzle-orm":"^0.45","zod":"^4","@anthropic-ai/sdk":"^0.80","openai":"^6"}}' > package.json && \
    npm install --omit=dev

# Stage 4: Production runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Playwright Chromium and its system dependencies
RUN npx playwright install-deps chromium && \
    npx playwright install chromium && \
    chmod -R 755 /ms-playwright

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output for the web server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Merge runtime packages into node_modules (standalone may already have some)
COPY --from=runtime-deps /deps/node_modules ./node_modules_runtime
RUN cp -rn ./node_modules_runtime/* ./node_modules/ 2>/dev/null; rm -rf ./node_modules_runtime

# Copy migration files + pre-compiled worker bundle (dist/worker.cjs). The
# bundle resolves all @/ path aliases at build time and ships as plain CJS,
# so the worker container just runs `node dist/worker.cjs`.
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/run-migrations.cjs ./run-migrations.cjs
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Copy startup script
COPY --chown=nextjs:nodejs start.sh ./start.sh
RUN chmod +x ./start.sh

# Create screenshots directory
RUN mkdir -p /app/screenshots && chown nextjs:nodejs /app/screenshots
RUN mkdir -p /app/public/screenshots && chown nextjs:nodejs /app/public/screenshots

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["./start.sh"]
