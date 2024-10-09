FROM node:lts-alpine

WORKDIR /minidns

COPY package.json yarn.lock ./

RUN yarn install --production && yarn cache clean

COPY . .

EXPOSE 53
EXPOSE 53/udp
EXPOSE 6160
EXPOSE 6161

ENTRYPOINT [ "./index.js" ]
