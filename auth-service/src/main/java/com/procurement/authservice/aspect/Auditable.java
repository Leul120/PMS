package com.procurement.authservice.aspect;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to mark methods that should be audited.
 * When applied to a method, the AuditLogAspect will log the action
 * to the audit log table.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    /**
     * Optional custom action name. If not specified, the action name
     * will be derived from the method name.
     */
    String action() default "";
    
    /**
     * Optional custom entity type. If not specified, the entity type
     * will be derived from the controller class name.
     */
    String entityType() default "";
    
    /**
     * Whether to include request arguments in the audit log description.
     */
    boolean includeArgs() default true;
}
