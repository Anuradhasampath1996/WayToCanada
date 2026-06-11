FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
ENV NODE_OPTIONS=--max-old-space-size=768
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://www.lightersmenia.com
ARG NEXT_PUBLIC_APP_URL=http://www.lightersmenia.com
ARG NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.lightersmenia.com
ARG NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=http://consultant.lightersmenia.com
ARG NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=http://portal.lightersmenia.com
ARG NEXT_PUBLIC_ADMIN_DASHBOARD_URL=http://admin.lightersmenia.com
ARG NEXT_PUBLIC_USER_DASHBOARD_URL=http://app.lightersmenia.com
ARG NEXT_PUBLIC_OCR_URL=
ARG NEXT_PUBLIC_PUBLIC_WEBSITE_URL=http://www.lightersmenia.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_USER_DASHBOARD_URL=$NEXT_PUBLIC_USER_DASHBOARD_URL
ENV NEXT_PUBLIC_CONSULTANT_WEBSITE_URL=$NEXT_PUBLIC_CONSULTANT_WEBSITE_URL
ENV NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL=$NEXT_PUBLIC_CONSULTANT_DASHBOARD_URL
ENV NEXT_PUBLIC_ADMIN_DASHBOARD_URL=$NEXT_PUBLIC_ADMIN_DASHBOARD_URL
ENV NEXT_PUBLIC_OCR_URL=$NEXT_PUBLIC_OCR_URL
ENV NEXT_PUBLIC_PUBLIC_WEBSITE_URL=$NEXT_PUBLIC_PUBLIC_WEBSITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=768
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@9 --activate && pnpm run build; \
    else \
      npm run build; \
    fi

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
