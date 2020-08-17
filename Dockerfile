FROM node:14.8.0

WORKDIR /home/node/app/

COPY package.json package-lock.json* ./

RUN npm install && npm cache clean --force

COPY . .

RUN npx sequelize-cli db:migrate

CMD ["npm", "run" ,"start"]