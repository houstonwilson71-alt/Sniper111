# syntax=docker/dockerfile:1
FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git ca-certificates

# Preserve the project's relative-path layout so the
# "replace ... => ../../common/proto/engine" directive resolves correctly.
WORKDIR /src

# Copy module definitions first for better layer caching.
COPY common/proto/engine/go.mod ./common/proto/engine/
COPY services/api-go/go.mod services/api-go/go.sum ./services/api-go/

WORKDIR /src/services/api-go
RUN go mod download

# Copy source and the generated protobuf bindings.
COPY services/api-go ./
COPY common/proto/engine ../common/proto/engine

RUN CGO_ENABLED=0 GOOS=linux go build -o /app/api .

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/api /api
EXPOSE 5000
ENTRYPOINT ["/api"]
