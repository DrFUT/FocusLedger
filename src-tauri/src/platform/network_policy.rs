/// FocusLedger's shipped desktop runtime is strictly local. This gate is not
/// configurable through imported settings or environment variables.
pub fn require_remote_services() -> Result<(), String> {
    Err("Remote services are disabled in FocusLedger; use local backup files.".into())
}

#[cfg(test)]
mod tests {
    #[test]
    fn remote_services_are_always_disabled() {
        assert!(super::require_remote_services().is_err());
    }
}
