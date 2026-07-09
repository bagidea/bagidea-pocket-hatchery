import styles from './ResourceBar.module.css'

interface ResourceBarProps {
  icon: string
  label: string
  value: string
  max?: string
  variant?: 'egg' | 'energy' | 'token'
}

export function ResourceBar({
  icon,
  label,
  value,
  max,
  variant = 'egg',
}: ResourceBarProps) {
  return (
    <div className={`${styles.bar} ${styles[variant]}`}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {value}
        {max && <span className={styles.max}> / {max}</span>}
      </span>
    </div>
  )
}
