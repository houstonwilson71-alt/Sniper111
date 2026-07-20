// services/api-go/pubsub.go
// Abstraction over Redis Pub/Sub and NATS. Falls back to a no-op if neither is configured.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/nats-io/nats.go"
	"github.com/redis/go-redis/v9"
)

type PubSub interface {
	publish(channel string, payload interface{}) error
	subscribe(handler func(string, []byte)) error
	Close() error
}

type noOpPubSub struct{}

func (n *noOpPubSub) publish(channel string, payload interface{}) error { return nil }
func (n *noOpPubSub) subscribe(handler func(string, []byte)) error       { return nil }
func (n *noOpPubSub) Close() error                                       { return nil }

type redisPubSub struct {
	client *redis.Client
}

func (r *redisPubSub) publish(channel string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return r.client.Publish(context.Background(), channel, data).Err()
}

func (r *redisPubSub) subscribe(handler func(string, []byte)) error {
	sub := r.client.Subscribe(context.Background(), "tokens:new", "tokens:filtered", "trades:new", "bot:state")
	ch := sub.Channel()
	go func() {
		for msg := range ch {
			handler(msg.Channel, []byte(msg.Payload))
		}
	}()
	return nil
}

func (r *redisPubSub) Close() error { return r.client.Close() }

type natsPubSub struct {
	conn      *nats.Conn
	sub       *nats.Subscription
}

func (n *natsPubSub) publish(channel string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return n.conn.Publish(channel, data)
}

func (n *natsPubSub) subscribe(handler func(string, []byte)) error {
	channels := []string{"tokens:new", "tokens:filtered", "trades:new", "bot:state"}
	var err error
	n.sub, err = n.conn.Subscribe("tokens.*", func(msg *nats.Msg) {
		handler(msg.Subject, msg.Data)
	})
	if err != nil {
		return err
	}
	_ = channels
	return nil
}

func (n *natsPubSub) Close() error {
	if n.sub != nil {
		_ = n.sub.Unsubscribe()
	}
	n.conn.Close()
	return nil
}

func mustInitPubSub() PubSub {
	natsURL := os.Getenv("NATS_URL")
	if natsURL != "" {
		nc, err := nats.Connect(natsURL)
		if err == nil {
			fmt.Println("NATS pub/sub connected")
			return &natsPubSub{conn: nc}
		}
		fmt.Fprintf(os.Stderr, "NATS connection failed: %v, falling back to Redis\n", err)
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Redis parse failed: %v, pub/sub disabled\n", err)
		return &noOpPubSub{}
	}
	client := redis.NewClient(opt)
	if err := client.Ping(context.Background()).Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Redis ping failed: %v, pub/sub disabled\n", err)
		_ = client.Close()
		return &noOpPubSub{}
	}
	fmt.Println("Redis pub/sub connected")
	return &redisPubSub{client: client}
}
