#!/usr/bin/env bash

set -eo pipefail

## Command dependencies: java, awk, curl (wget) 
## File dependencies: $ROOT_DIR/jenkins.version

# Helper functions for logging 
info() {
    echo "[INFO]" "$*"
}
warn() {
    echo "[WARN]" "$*"
}
error_and_exit() {
    # Log all given arguments except the last on   
    echo "[ERROR]" "${@:1:$#-1}. Exit with non-zero code" 
    # last argument as exit code.
    exit ${@: -1}
}

# Check if Java installation is available.
# Else, check if Java installation is Java17 or else.
# Beginning with the Jenkins 2.463 weekly release (scheduled for release on June 18, 2024), Jenkins requires Java 17 or newer
# Source: https://www.jenkins.io/blog/2024/06/11/require-java-17/
if [ -z "${JAVA_HOME}" ] || ! command -v java 2>&1 >/dev/null ; then 
    error_and_exit "Current machine does not have Java installation to proceed further"  1
else
    # Get the Java version
    java_version=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}')
    # Extract major version
    # Handles the version format. Java 17 and earlier are in the form 1.x, while Java 9+ drops the leading 1.
    java_major_version=$(echo "${java_version}" | awk -F '.' '{if ($1 == "1") print $2; else print $1}')
    # Check if the major version is 17 or higher
    if [[ "$java_major_version" -le 17 ]]; then
        error_and_exit "Current machine has Java version that is less than 17 (version: $java_version)" 1
    fi
fi

# Get Jenkins version pinned in "jenkins.version"
if [ ! -f "./jenkins.version" ]; then
    error_and_exit "Root directory does not have \"jenkins.version\" to select approriate Jenkins version" 1
fi

# Install Jenkins if the WAR file does not exist
# Can execute the download task either via "curl" or "wget".
CURRENT_JENKINS_VERSION="$(cat ./jenkins.version)"
if [ ! -f "./jenkins-${CURRENT_JENKINS_VERSION}.war" ]; then
    info "Downloading Jenkins..."
    if command -v curl; then 
        curl --location https://get.jenkins.io/war/${CURRENT_JENKINS_VERSION}/jenkins.war --output jenkins-${CURRENT_JENKINS_VERSION}.war
    elif command -v wget; then
        wget https://get.jenkins.io/war/${CURRENT_JENKINS_VERSION}/jenkins-${CURRENT_JENKINS_VERSION}.war
    else
        error_and_exit "Current machine does not have \"wget\" or \"curl\" to download Jenkins WAR file" 1
    fi

fi

# Create directory for Jenkins logs.
mkdir -p ./logs 

# Start the Jenkins
if [ -f "./jenkins-${CURRENT_JENKINS_VERSION}.war" ] && [ -d "./logs" ]; then
    jenkins_log_name="$(date '+%Y-%m-%d-%H')"
    java -jar ./jenkins-${CURRENT_JENKINS_VERSION}.war 2>&1 | tee /dev/tty >> "./logs/jenkins-${jenkins_log_name}.log"
fi
