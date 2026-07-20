# syntax=docker/dockerfile:1
FROM golang:1.23-alpine AS builder
WORKDIR /build
RUN apk add --no-cache git ca-certificates

# Copy module definitions first for better layer caching.
COPY services/api-go/go.mod services/api-go/go.sum ./
COPY common/proto/engine/go.mod ./common/proto/engine/
RUN go mod download

# Copy source and the generated protobuf bindings.
COPY services/api-go ./
COPY common/proto/engine ./common/proto/engine

RUN CGO_ENABLED=0 GOOS=linux go build -o /app/api .

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/api /api
EXPOSE 5000
ENTRYPOINT ["/api"]
