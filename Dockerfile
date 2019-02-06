FROM node:9

COPY package*.json /usr/src/app/

# Create app directory
WORKDIR /usr/src/app

RUN npm i npm@latest -g && \
    npm i nodemon@latest -g && \
    npm i ts-node mocha -g && \
    npm install

COPY . .

CMD [ "npm", "run", "start:dev" ]