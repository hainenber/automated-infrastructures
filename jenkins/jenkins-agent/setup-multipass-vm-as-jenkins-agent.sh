#!/usr/bin/env bash

# Build Ubuntu VMs that are readily Jenkins agent.

current_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Java
for i in $(seq 1 1); do
    vm_name="java-app-builder-${i}"
    if ! multipass list --format=csv | grep "${vm_name}" >/dev/null 2>&1 ; then
        echo "[INFO] VM ${vm_name} does not exist. Creating..."
        multipass launch --cpus 1 --disk 10G --memory 2G noble --name "${vm_name}" --cloud-init "${current_dir}/cloud-config.java.yaml"
        echo "[INFO] Done creating VM ${vm_name}"
    else
        echo "[INFO] VM ${vm_name} exists."
    fi
done

# JavaScript, TypeScript
for i in $(seq 1 1); do
    vm_name="javascript-app-builder-${i}"
    if ! multipass list --format=csv | grep "${vm_name}" >/dev/null 2>&1 ; then
        echo "[INFO] VM ${vm_name} does not exist. Creating..."
        multipass launch --cpus 1 --disk 10G --memory 2G noble --name "${vm_name}" --cloud-init "${current_dir}/cloud-config.javascript.yaml"
        echo "[INFO] Done creating VM ${vm_name}"
    else
        echo "[INFO] VM ${vm_name} exists."
    fi
done
