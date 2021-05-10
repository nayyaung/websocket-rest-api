FROM node:14.16.1

WORKDIR /app
COPY package.json package-lock.json index.js cert.pem ./

RUN npm install

EXPOSE 3000

ENV REDIS_URL=redis://54.179.141.146:6379
ENV REDIS_USER=postapp
ENV REDIS_PASSWORD=password3251!A
ENV REDIS_HOST=54.179.141.146
ENV REDIS_PORT=6379

CMD [ "node", "index.js" ]
