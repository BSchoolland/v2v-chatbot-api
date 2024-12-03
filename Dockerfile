FROM ghcr.io/puppeteer/puppeteer:22

# Temporarily switch to root due to permission issues with the puppeteer image
USER root

WORKDIR /home/pptruser/app

# Set the cache directory environment variable
ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

COPY package*.json ./

# Copy the rest of the application
COPY . .

# Ensure correct permissions for npm and cache directories
RUN mkdir -p $PUPPETEER_CACHE_DIR && \
    chown -R pptruser:pptruser /home/pptruser /home/pptruser/.npm $PUPPETEER_CACHE_DIR

# Install dependencies
RUN npm install

# Install Chrome browser and verify installation
RUN npx puppeteer browsers install chrome && \
    echo "Installed Chrome browsers:" && \
    ls -l $PUPPETEER_CACHE_DIR && \
    find $PUPPETEER_CACHE_DIR -name "chrome" -type f

# Ensure correct ownership of installed browsers
RUN chown -R pptruser:pptruser $PUPPETEER_CACHE_DIR

# Switch back to pptruser
USER pptruser

CMD ["node", "server.js"]
