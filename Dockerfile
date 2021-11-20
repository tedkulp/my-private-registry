FROM node:16

RUN apt update -y && \
  apt upgrade -y && \
  rm -rf /var/lib/apt/lists/*

RUN mkdir /app
WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY . .

RUN mkdir blobs && mkdir manifests && mkdir uploads

EXPOSE 4200

CMD [ "./node_modules/.bin/nx", "run-many", "--target=serve", "--projects=api,client", "--parallel"]
