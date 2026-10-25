# Playwright image so the same Actor can run in browser mode (useBrowser) for
# sites that block plain HTTP requests.
FROM apify/actor-node-playwright-chrome:24 AS builder

COPY --chown=myuser package*.json ./
RUN npm install --include=dev --audit=false
COPY --chown=myuser . ./
RUN npm run build

FROM apify/actor-node-playwright-chrome:24

COPY --chown=myuser package*.json ./
RUN npm install --omit=dev --omit=optional --audit=false
COPY --from=builder --chown=myuser /home/myuser/dist ./dist
COPY --chown=myuser .actor ./.actor

CMD ["npm", "start", "--silent"]
