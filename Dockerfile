FROM node:7

WORKDIR /code
ADD . /code
RUN npm install

RUN mkdir /code/data

VOLUME /code/data

RUN chmod 755 ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh", "-d", "/code/data"]

CMD ["serve"]
