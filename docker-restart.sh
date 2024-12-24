#!/bin/bash

wait_for_port() {
    local port=$1
    local max_attempts=30
    local attempt=1
    
    echo "Checking if port $port is in use..."
    
    while [ $attempt -le $max_attempts ]; do
        if ! netstat -tuln | grep ":$port" > /dev/null; then
            echo "Port $port is free"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts: Port $port still in use, waiting..."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo "Timeout waiting for port $port to become free"
    return 1
}

cleanup_docker() {
    echo "Cleaning up Docker resources..."
    docker system prune -f
    
    echo "Stopping containers..."
    docker-compose down
    
    # Give processes a moment to fully release resources
    sleep 2
}

main() {
    cleanup_docker
    
    if ! wait_for_port 3000; then
        echo "Failed to free up port 3000. Exiting..."
        exit 1
    fi
    
    echo "Starting containers..."
    docker-compose up --build -d
    
    echo "Waiting for service to be ready..."
    sleep 5
    
    if netstat -tuln | grep ":3000" > /dev/null; then
        echo "Service successfully started on port 3000"
    else
        echo "Warning: Service not detected on port 3000"
    fi
}

main