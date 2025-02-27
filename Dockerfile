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

CMD ["node", "server.js"]
