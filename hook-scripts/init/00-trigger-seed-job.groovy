import jenkins.model.Jenkins
import hudson.model.Cause
import hudson.model.Result

import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval
import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval.PendingScript

// Trigger seed job.
def jenkins = Jenkins.get()
def job = jenkins.getItemByFullName('seed')

if (job == null) {
    println("[INIT] Seed job not found. Exiting script")
    return
}

// List out scripts for approval
// Only approve hash of jobs declared in ./data/jobs
// This is to allow seed job to run normally. 
ScriptApproval scriptApproval = ScriptApproval.get()
for (PendingScript pendingScript in scriptApproval.getPendingScripts()) {
    String scriptHash = pendingScript.getHash()
    // build_jenkins_plugin_manager_jar.groovy
    if (scriptHash == 'SHA512:fea3f17ae00259d0e9fbe1cc6fc65e16a507a11ed2970744f627b9099ccde2ca7c8aca772d4ebec2961e9f637a03bd50957cbeaa0b746f96a97aa64f508b7bae') {
        scriptApproval.approveScript(scriptHash)
    }
}

// Temporarily allow controller node to execute seed job.
// Controller node will be disabled for builds in 01-disable-builds-on-controller-node.groovy  
def controllerNode = Jenkins.get()
controllerNode.setNumExecutors(1);
controllerNode.save();

def cause = new Cause.RemoteCause("script", "Triggered by 00-trigger-seed-job.groovy")
def future = job.scheduleBuild2(0, cause)

if (future != null) {
    println("[INIT] Seed job triggered successfully. Waiting for the job to finish...")

    // Wait until the build is complete.
    // Blocks the script until the build is finished .
    def build = future.get() 

    // Check the result of the build.
    def result = build.getResult()

    if (result == Result.SUCCESS) {
        println("[INIT] Seed job completed successfully.")
    } else {
        println("[INIT] Seed job did not complete successfully. Status: ${result.toString()}")
    }
} else {
    println("[INIT] Failed to trigger seed job.")
}
