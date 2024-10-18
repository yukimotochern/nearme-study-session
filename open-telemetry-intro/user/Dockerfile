FROM node:lts-alpine

# Intall Pulumi CLI to prevent post install pulumi errors
RUN apk --no-cache add curl
RUN curl -fsSL https://get.pulumi.com | sh -s -- --version 3.136.1
ENV PATH="$PATH:/root/.pulumi/bin"

WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm install

COPY . .

RUN npx nx run-many -t prisma-generate

RUN npx nx build open-telemetry-intro-instrumentation

CMD [ "npx", "nx", "serve", "open-telemetry-intro-user" ]
