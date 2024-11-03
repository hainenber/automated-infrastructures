#!/usr/bin/env bash

# Build Ubuntu VMs that are readily Jenkins agent.

current_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for i in $(seq 1 2); do
    vm_name="java-app-builder-${i}"
    if ! multipass list --format=csv | grep "${vm_name}" >/dev/null 2>&1 ; then
        multipass launch --cpus 1 --disk 10G --memory 2G noble --name "${vm_name}" --cloud-init "${current_dir}/cloud-config.yaml"
    else
        echo "[INFO] ${vm_name} exists."
    fi
done
