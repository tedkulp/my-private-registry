FROM node:7

WORKDIR /code
ADD . /code
RUN npm install

RUN chmod 755 ./docker/run.sh

EXPOSE 3000

ENTRYPOINT ["./docker/run.sh"]
