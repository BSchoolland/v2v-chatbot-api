FROM ghcr.io/puppeteer/puppeteer:22

# Root user is required to install Chrome
USER root

WORKDIR /home/pptruser/app

# Set the cache directory environment variable
ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

COPY package*.json ./
# Install dependencies
RUN npm install
# Copy the rest of the application
COPY . .

# Install Chrome browser and verify installation
RUN npx puppeteer browsers install chrome && \
    echo "Installed Chrome browsers:" && \
    ls -l $PUPPETEER_CACHE_DIR && \
    find $PUPPETEER_CACHE_DIR -name "chrome" -type f

# The app runs as pptruser (docker-compose.yml) so Chrome can sandbox itself, so
# every directory it writes to at runtime must be owned by pptruser. The logs and
# uploads dirs are gitignored and mkdir'd on demand at require time, which would
# otherwise EACCES on boot.
RUN mkdir -p backend/storage/logs backend/database/queries/storage/uploads data && \
    chown -R pptruser:pptruser backend/storage backend/database/queries/storage data

CMD ["node", "server.js"]
