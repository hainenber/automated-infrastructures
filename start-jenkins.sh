#!/usr/bin/env bash

set -eo pipefail

## Command dependencies: java, awk, curl (wget), jq 
## File dependencies: $ROOT_DIR/jenkins.version

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Helper functions for logging 
info() {
    echo "[INFO]" "$*"
}
warn() {
    echo "[WARN]" "$*"
}
error_and_exit() {
    # Log all given arguments except the last on   
    # shellcheck disable=SC2145
    echo "[ERROR]" "${@:1:$#-1}. Exit with non-zero code" 
    # last argument as exit code.
    exit "${@: -1}"
}

# Helper function to help with downloading Jenkins-related binaries 
download_artifact() {
    if [ ! -f "${ROOT_DIR}/versions/${1}.version.json" ]; then
        error_and_exit "Root directory does not have \"${1}.version\" to select approriate ${1} version" 1
    fi

    ARTIFACT_VERSION="$(jq -r .version "${ROOT_DIR}"/versions/"${1}".version.json)"
    ARTIFACT_TEMPLATE_DOWNLOAD_URL="$(jq -r .download_url "${ROOT_DIR}"/versions/"${1}".version.json)"
    ARTIFACT_TEMPLATE_NAME="$(jq -r .artifact_name "${ROOT_DIR}"/versions/"${1}".version.json)"

    # Interpolate ARTIFACT_VERSION into template variables read from .version files  
    ARTIFACT_DOWNLOAD_URL=$(eval "ARTIFACT_VERSION=${ARTIFACT_VERSION} echo \"$ARTIFACT_TEMPLATE_DOWNLOAD_URL\"")
    ARTIFACT_NAME=$(eval "ARTIFACT_VERSION=${ARTIFACT_VERSION} echo \"$ARTIFACT_TEMPLATE_NAME\"")

    if [ ! -f "./${ARTIFACT_NAME}" ]; then
        info "Downloading $1..."
        if command -v curl >/dev/null 2>&1; then 
            curl --location "${ARTIFACT_DOWNLOAD_URL}" --output "${ARTIFACT_NAME}"
        elif command -v wget >/dev/null 2>&1; then
            wget "${ARTIFACT_DOWNLOAD_URL}" -O "${ARTIFACT_NAME}"
        else
            error_and_exit "Current machine does not have \"wget\" or \"curl\" to download binary" 1
        fi
    fi
}

# Helper function to ensure only 1 artifact version exist in $ROOT_DIR
ensure_single_artifact() {
    if [ $# -ne 1 ]; then
        error_and_exit "There are more than 1 artifact matching $*" 1
    else
        info "Only 1 artifact matching pattern ($*). Continue"
    fi
}

# Check if Java installation is available.
# Else, check if Java installation is Java17 or else.
# Beginning with the Jenkins 2.463 weekly release (scheduled for release on June 18, 2024), Jenkins requires Java 17 or newer
# Source: https://www.jenkins.io/blog/2024/06/11/require-java-17/
if [ -z "${JAVA_HOME}" ] || ! command -v java >/dev/null 2>&1 ; then 
    error_and_exit "Current machine does not have Java installation to proceed further" 1
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

# Install required artifacts
# Can execute the download task either via "curl" or "wget".
download_artifact "jenkins"
download_artifact "jenkins-plugin-manager"

# Ensure only 1 version for each artifact to be present 
ensure_single_artifact jenkins-*.war
ensure_single_artifact jenkins-plugin-manager-*.jar

# Create directory for Jenkins logs and plugins
mkdir -p ./logs ./data ./data/plugins ./data/init.groovy.d ./data/secrets

if ls ./jenkins-*.war >/dev/null 2>&1; then
    # Prepare the plugins
    if [ -f "${ROOT_DIR}/configs/plugins.yaml" ]; then
        info "Handling plugins..."
        java -jar jenkins-plugin-manager-*.jar \
            --war ./jenkins-*.war \
            --verbose \
            --plugin-download-directory ./data/plugins \
            --plugin-file "${ROOT_DIR}/configs/plugins.yaml"
    else
        warn "Configuration file for Jenkins plugins are not found. Handle plugins manually."
    fi

    # Configure Groovy init hook scripts
    if [ -d "${ROOT_DIR}/hook-scripts/init" ]; then
        if [ "$(find ./data/init.groovy.d -type f | wc -l | xargs)" -gt "0" ]; then
            rm -rf ./data/init.groovy.d/*
        fi
        cp "${ROOT_DIR}/hook-scripts/init/"*.groovy ./data/init.groovy.d
    fi

    # Copy local secrets to $JENKINS_HOME for configuration by JCasC
    cp "${ROOT_DIR}/secrets/"* ./data/secrets

    # Start the Jenkins
    jenkins_log_name="$(date '+%Y-%m-%d-%H')"
    JENKINS_HOME="./data" CASC_JENKINS_CONFIG="${ROOT_DIR}/configs/jcasc.yaml" java -jar ./jenkins-*.war 2>&1 | tee /dev/tty >> "./logs/jenkins-${jenkins_log_name}.log"
fi
