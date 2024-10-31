#!/usr/bin/env bash

# Build Ubuntu VMs that are readily Jenkins agent.

for i in seq 2 2; do
    multipass launch --cpus 1 --disk 10G --memory 2G noble --name java-app-builder-2 --cloud-init cloud-config.yaml
done
