FROM node:20-slim

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY index.js ./

RUN npm install

RUN mkdir -p /app/results /app/downloads

EXPOSE 3000

CMD ["node", "index.js"]