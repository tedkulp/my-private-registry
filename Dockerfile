FROM node:alpine

WORKDIR /code
RUN mkdir /code/data
VOLUME /code/data

COPY package.json package.json
COPY yarn.lock yarn.lock
RUN yarn install

ADD . /code

RUN chmod 755 ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh", "-d", "/code/data"]

CMD ["serve"]
