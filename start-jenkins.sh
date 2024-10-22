#!/usr/bin/env bash

set -euox pipefail

# Helper functions for logging 
info() {
    echo "[INFO]" "$*"
}
# TODO: Allow below function to use last argument as exit code.
error_and_exit() {
    echo "[ERROR]" "$*" 
}

# TODO: Check if Java 8+ installation is available.

# TODO: Fetch latest Jenkins version from remote registry.  

# Install Jenkins if the WAR file does not exist
# Can execute the download task either via "curl" or "wget".
if [ ! -f "./jenkins.war" ]; then
    info "Downloading Jenkins... "
    if command -v curl; then 
        curl --location https://get.jenkins.io/war/2.481/jenkins.war --output jenkins.war
    elif command -v wget; then
        wget https://get.jenkins.io/war/2.481/jenkins.war
    else
        error_and_exit "Current machine does not have \"wget\" or \"curl\" to download Jenkins WAR file. Exit with non-zero code"
    fi

fi

# Create directory for Jenkins logs.
mkdir -p ./logs 

# Start the Jenkins
if [ -f "./jenkins.war" ] && [ -d "./logs" ]; then
    java -jar ./jenkins.war >> ./logs/jenkins.log 2>&1
fi
