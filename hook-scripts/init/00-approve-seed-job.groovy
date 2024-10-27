import org.jenkinsci.plugins.scriptsecurity.scripts.ScriptApproval

// Approve seed job
ScriptApproval scriptApproval = ScriptApproval.get()
scriptApproval.pendingScripts.each {
    scriptApproval.approveScript(it.hash)
}
