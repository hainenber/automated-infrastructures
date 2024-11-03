import jenkins.model.Jenkins
import hudson.model.Cause
import hudson.model.Result

import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval
import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval.PendingScript

// List out scripts for approval
// Only approve hash of jobs declared in ./data/jobs
// This is to allow seed job to run normally. 

class SeedJob {
    static void approvePendingScriptsInSeedJob() {
        def approvedHashes = [
            // build_jenkins_plugin_manager_jar.groovy
            'SHA512:da1e258d4146dafa3b703297a9d690aa43b38765200f1728a98de3cab79d69ff8c11fe39bfa7ab1eb7fb5e61813e27bc279fccd2d8620937cc1ff6879f811739',
            // build_jenkins_war.groovy
            'SHA512:ad56a4949351d20ecb0416e1996ddae71d0d209389a26a4e896a5031368e54f694a7b2ae96e676761069ecfcc75c3b6b3b69598f1135a6befb72e6d8a60a8517',
        ]
        def scriptApproval = ScriptApproval.get()
        scriptApproval.getPendingScripts().clone().each { pendingScript ->
            String scriptHash = pendingScript.getHash()
            if (approvedHashes.contains(scriptHash)) {
                scriptApproval.approveScript(scriptHash)
            }
        }
    }

    static int runSeedJob(count) {
        def job = Jenkins.get().getItemByFullName('seed')
        if (job == null) {
            throw new RuntimeException("[INIT][ERROR] Seed job not found. Exiting script")
        }

        def cause = new Cause.RemoteCause("script", "Triggered by 00-trigger-seed-job.groovy")
        def future = job.scheduleBuild2(0, cause)

        if (future != null) {
            println("[INIT][INFO] Seed job triggered successfully. Waiting for the job to finish...")

            // Wait until the build is complete.
            // Blocks the script until the build is finished.
            def build = future.get() 

            // Check the result of the build.
            def result = build.getResult()

            if (result == Result.SUCCESS) {
                println("[INIT][INFO] Seed job completed successfully.")
            } else {
                if (count == 1) {
                    println("[INIT][WARN] Seed job did not complete successfully. Possibly due to unapproved Job DSL scripts.")
                    return 0
                } else {
                    throw new RuntimeException("[INIT][ERROR] Seed job did not complete successfully. Status: ${result.toString()}")
                }

            }
        } else {
            throw new RuntimeException("[INIT][ERROR] Failed to trigger seed job.")
        }

        return 1
    }
}

// Temporarily allow controller node to execute seed job.
// Controller node will be disabled for builds in 01-disable-builds-on-controller-node.groovy  
def controllerNode = Jenkins.get()
controllerNode.setNumExecutors(1);
controllerNode.save();

// Trigger
def firstSeedJobRun = SeedJob.runSeedJob(1)
if (firstSeedJobRun != 1) {
    SeedJob.approvePendingScriptsInSeedJob()
    println("[INIT][INFO] Rerunning seed job after finish approving Job DSL scripts.")
    SeedJob.runSeedJob(2)
}