# Use the official node image as a parent image
FROM node:18

# Set the working directory
WORKDIR /app

# COPY ./chain/out ./chain/out
COPY . .

# Install dependencies and setup
RUN yarn install

EXPOSE 8080
# Specify the command to run on container start
CMD ["node", "src/server.js"]
