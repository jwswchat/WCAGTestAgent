# Use the official Microsoft Playwright image as base
# This image includes Node.js and all necessary browser dependencies
FROM mcr.microsoft.com/playwright:v1.57.0-noble

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Ensure reports and temp directories exist and are writable
RUN mkdir -p reports temp && chmod 777 reports temp

# Set environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 7860

# Command to run the application
CMD ["node", "server/server.js"]
