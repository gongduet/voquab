# 09_COMPONENT_LIBRARY.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Button Components](#button-components)
3. [Card Components](#card-components)
4. [Modal Components](#modal-components)
5. [Form Components](#form-components)
6. [Feedback Components](#feedback-components)
7. [Layout Components](#layout-components)
8. [Specialized Components](#specialized-components)

---

## OVERVIEW

This library documents all reusable UI components in Voquab. Each component follows the design system and is built with React 19 hooks.

**Philosophy:**
- Components are composable (build complex from simple)
- Props follow consistent naming patterns
- Accessible by default (ARIA labels, keyboard nav)
- Mobile-first responsive

**Location:** `/src/components/common/`

---

## BUTTON COMPONENTS

### Primary Button

**Usage:** Main call-to-action

```jsx
import { Button } from '@/components/common';

<Button
  variant="primary"
  size="md"
  onClick={handleClick}
  disabled={isLoading}
  icon={<Star />}
  iconPosition="left"
>
  Start Learning
</Button>
```

**Implementation:**
```jsx
// src/components/common/Button.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  type = 'button',
  className = '',
  ...props
}) {
  const baseStyles = `
    inline-flex items-center justify-center
    font-semibold rounded-lg
    transition-all duration-150
    focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const variants = {
    primary: `
      bg-primary-500 hover:bg-primary-700 active:bg-primary-800
      text-white shadow-md hover:shadow-lg
      focus:ring-primary-500
    `,
    secondary: `
      bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300
      text-neutral-900 border border-neutral-300
      focus:ring-neutral-500
    `,
    danger: `
      bg-error-500 hover:bg-error-700 active:bg-error-800
      text-white shadow-md hover:shadow-lg
      focus:ring-error-500
    `,
    ghost: `
      bg-transparent hover:bg-neutral-100 active:bg-neutral-200
      text-neutral-700
      focus:ring-neutral-500
    `
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${widthClass}
        ${className}
      `}
      {...props}
    >
      {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
      {!loading && icon && iconPosition === 'left' && (
        <span className="mr-2">{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className="ml-2">{icon}</span>
      )}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  fullWidth: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string
};
```

---

### Icon Button

**Usage:** Actions without text labels

```jsx
<IconButton
  icon={<X />}
  onClick={handleClose}
  aria-label="Close modal"
  variant="ghost"
/>
```

**Implementation:**
```jsx
export function IconButton({
  icon,
  onClick,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
  ...props
}) {
  const baseStyles = `
    inline-flex items-center justify-center
    rounded-full transition-all duration-150
    focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const variants = {
    ghost: 'hover:bg-neutral-100 active:bg-neutral-200',
    primary: 'bg-primary-500 hover:bg-primary-700 text-white',
    danger: 'hover:bg-error-50 text-error-600'
  };
  
  const sizes = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
```

---

## CARD COMPONENTS

### Card

**Usage:** Container for grouped content

```jsx
<Card
  variant="elevated"
  padding="md"
  hoverable
>
  <h3>Card Title</h3>
  <p>Card content</p>
</Card>
```

**Implementation:**
```jsx
export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  hoverable = false,
  onClick,
  className = '',
  ...props
}) {
  const baseStyles = 'bg-white rounded-xl transition-shadow duration-150';
  
  const variants = {
    elevated: 'shadow hover:shadow-md',
    outlined: 'border border-neutral-200',
    flat: 'bg-neutral-50'
  };
  
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };
  
  const hoverStyles = hoverable ? 'cursor-pointer hover:shadow-lg' : '';
  const clickableStyles = onClick ? 'cursor-pointer' : '';
  
  return (
    <div
      onClick={onClick}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${paddings[padding]}
        ${hoverStyles}
        ${clickableStyles}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
```

---

### ChapterCard

**Usage:** Display chapter with progress

```jsx
<ChapterCard
  chapter={chapter}
  isLocked={!chapter.isUnlocked}
  progress={chapter.encounterPercentage}
  onRead={handleRead}
  onStudy={handleStudy}
/>
```

**Implementation:**
```jsx
export function ChapterCard({
  chapter,
  isLocked,
  progress,
  onRead,
  onStudy
}) {
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {isLocked ? (
              <Lock className="w-5 h-5 text-neutral-400" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success-500" />
            )}
            <h3 className="text-xl font-bold text-neutral-900">
              Chapter {chapter.number}
            </h3>
          </div>
          <p className="text-sm text-neutral-600 mt-1">
            {chapter.title}
          </p>
        </div>
      </div>
      
      {!isLocked && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-neutral-600">
            <span>Progress</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}
      
      <div className="flex gap-3">
        {isLocked ? (
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={onStudy}
          >
            Study to Unlock
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={onRead}
              icon={<Book className="w-4 h-4" />}
            >
              Read
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onStudy}
              icon={<GraduationCap className="w-4 h-4" />}
            >
              Study
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
```

---

## MODAL COMPONENTS

### Modal

**Usage:** Overlay dialogs

```jsx
<Modal
  isOpen={showModal}
  onClose={handleClose}
  title="Confirm Action"
  size="md"
>
  <p>Are you sure?</p>
  <div className="flex gap-3 mt-6">
    <Button variant="secondary" onClick={handleClose}>
      Cancel
    </Button>
    <Button variant="danger" onClick={handleConfirm}>
      Confirm
    </Button>
  </div>
</Modal>
```

**Implementation:**
```jsx
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  className = ''
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className={`
          relative bg-white rounded-2xl shadow-xl
          ${sizes[size]} w-full max-h-[90vh] overflow-auto
          ${className}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-2xl font-bold text-neutral-900">
            {title}
          </h2>
          {showCloseButton && (
            <IconButton
              icon={<X className="w-5 h-5" />}
              onClick={onClose}
              aria-label="Close modal"
            />
          )}
        </div>
        
        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
```

---

### BottomSheet (Mobile)

**Usage:** Mobile-optimized modal from bottom

```jsx
<BottomSheet
  isOpen={showSheet}
  onClose={handleClose}
  title="Word Definition"
>
  <DefinitionContent word={word} />
</BottomSheet>
```

**Implementation:**
```jsx
export function BottomSheet({
  isOpen,
  onClose,
  title,
  children
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div
        className={`
          absolute bottom-0 left-0 right-0
          bg-white rounded-t-3xl shadow-xl
          max-h-[85vh] overflow-auto
          transform transition-transform duration-200
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-neutral-300 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-6 pb-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">
            {title}
          </h2>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
```

---

## FORM COMPONENTS

### Input

**Usage:** Text input fields

```jsx
<Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="your@email.com"
  error={emailError}
  required
/>
```

**Implementation:**
```jsx
export function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  icon,
  className = '',
  ...props
}) {
  const id = useId();
  
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-neutral-700"
        >
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            {icon}
          </div>
        )}
        
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            w-full px-4 py-3 rounded-lg
            border ${error ? 'border-error-500' : 'border-neutral-300'}
            focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-neutral-100 disabled:cursor-not-allowed
            ${icon ? 'pl-10' : ''}
            transition-colors duration-150
          `}
          {...props}
        />
      </div>
      
      {error && (
        <p className="text-sm text-error-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-neutral-600">{helperText}</p>
      )}
    </div>
  );
}
```

---

## FEEDBACK COMPONENTS

### Toast

**Usage:** Temporary notifications

```jsx
// useToast hook
const { showToast } = useToast();

showToast({
  type: 'success',
  message: 'Word added to study queue',
  duration: 3000
});
```

**Implementation:**
```jsx
// Toast container
export function ToastContainer() {
  const { toasts, removeToast } = useToastContext();
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// Individual toast
function Toast({ type, message, onClose }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success-600" />,
    error: <AlertCircle className="w-5 h-5 text-error-600" />,
    info: <Info className="w-5 h-5 text-info-600" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning-600" />
  };
  
  const backgrounds = {
    success: 'bg-success-50 border-success-200',
    error: 'bg-error-50 border-error-200',
    info: 'bg-info-50 border-info-200',
    warning: 'bg-warning-50 border-warning-200'
  };
  
  return (
    <div
      className={`
        flex items-center gap-3 p-4 rounded-lg border
        shadow-lg min-w-[300px]
        ${backgrounds[type]}
        animate-slide-in
      `}
    >
      {icons[type]}
      <p className="flex-1 text-sm font-medium text-neutral-900">
        {message}
      </p>
      <IconButton
        icon={<X className="w-4 h-4" />}
        onClick={onClose}
        variant="ghost"
        size="sm"
        aria-label="Close notification"
      />
    </div>
  );
}
```

---

### Progress Bar

**Usage:** Show progress percentage

```jsx
<ProgressBar
  value={0.75}
  label="Chapter Progress"
  showPercentage
  color="primary"
/>
```

**Implementation:**
```jsx
export function ProgressBar({
  value,
  label,
  showPercentage = false,
  color = 'primary',
  height = 'md',
  className = ''
}) {
  const percentage = Math.round(value * 100);
  
  const colors = {
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500'
  };
  
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };
  
  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex justify-between text-sm text-neutral-600 mb-2">
          {label && <span>{label}</span>}
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      
      <div className={`w-full bg-neutral-200 rounded-full overflow-hidden ${heights[height]}`}>
        <div
          className={`${colors[color]} ${heights[height]} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

---

### LoadingSpinner

**Usage:** Loading states

```jsx
<LoadingSpinner size="lg" text="Loading words..." />
```

**Implementation:**
```jsx
export function LoadingSpinner({
  size = 'md',
  text,
  className = ''
}) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className={`${sizes[size]} text-primary-500 animate-spin`} />
      {text && (
        <p className="text-sm text-neutral-600">{text}</p>
      )}
    </div>
  );
}
```

---

## LAYOUT COMPONENTS

### Container

**Usage:** Centered content container

```jsx
<Container size="md">
  <h1>Page Content</h1>
</Container>
```

**Implementation:**
```jsx
export function Container({
  children,
  size = 'md',
  className = ''
}) {
  const sizes = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  };
  
  return (
    <div className={`${sizes[size]} mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
```

---

### Stack

**Usage:** Vertical spacing between children

```jsx
<Stack spacing="md">
  <h1>Title</h1>
  <p>Paragraph</p>
  <Button>Action</Button>
</Stack>
```

**Implementation:**
```jsx
export function Stack({
  children,
  spacing = 'md',
  className = ''
}) {
  const spacings = {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8'
  };
  
  return (
    <div className={`${spacings[spacing]} ${className}`}>
      {children}
    </div>
  );
}
```

---

## SPECIALIZED COMPONENTS

### HealthIndicator

**Usage:** Show word health with color

```jsx
<HealthIndicator
  health={45}
  showLabel
  size="lg"
/>
```

**Implementation:**
```jsx
export function HealthIndicator({
  health,
  showLabel = false,
  size = 'md'
}) {
  const getHealthColor = (h) => {
    if (h < 20) return 'bg-error-500';
    if (h < 40) return 'bg-warning-500';
    if (h < 60) return 'bg-warning-400';
    if (h < 80) return 'bg-success-400';
    return 'bg-success-500';
  };
  
  const getHealthStatus = (h) => {
    if (h < 20) return 'Critical';
    if (h < 40) return 'Low';
    if (h < 60) return 'Medium';
    if (h < 80) return 'Good';
    return 'Excellent';
  };
  
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };
  
  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-xs text-neutral-600 mb-1">
          <span>Health: {getHealthStatus(health)}</span>
          <span>{health}%</span>
        </div>
      )}
      
      <div className={`w-full bg-neutral-200 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${getHealthColor(health)} ${heights[size]} rounded-full transition-all duration-300`}
          style={{ width: `${health}%` }}
        />
      </div>
    </div>
  );
}
```

---

### Badge

**Usage:** Small status indicators

```jsx
<Badge variant="success">Level 5</Badge>
<Badge variant="warning">New</Badge>
```

**Implementation:**
```jsx
export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = ''
}) {
  const variants = {
    neutral: 'bg-neutral-100 text-neutral-700',
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700'
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };
  
  return (
    <span
      className={`
        inline-flex items-center gap-1
        font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {icon}
      {children}
    </span>
  );
}
```

---

## USAGE EXAMPLES

### Complete Page Example

```jsx
import { Container, Stack, Card, Button } from '@/components/common';

function DashboardPage() {
  return (
    <Container size="lg">
      <Stack spacing="lg">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">
            Dashboard
          </h1>
          <p className="text-neutral-600 mt-2">
            Welcome back to Voquab
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card padding="md">
            <Stack spacing="sm">
              <h3 className="text-lg font-semibold">Words Today</h3>
              <p className="text-3xl font-bold text-primary-500">42</p>
            </Stack>
          </Card>
          
          <Card padding="md">
            <Stack spacing="sm">
              <h3 className="text-lg font-semibold">Streak</h3>
              <p className="text-3xl font-bold text-secondary-500">7 days</p>
            </Stack>
          </Card>
          
          <Card padding="md">
            <Stack spacing="sm">
              <h3 className="text-lg font-semibold">Chapter</h3>
              <p className="text-3xl font-bold text-neutral-900">3</p>
            </Stack>
          </Card>
        </div>
        
        <Card padding="lg">
          <Stack spacing="md">
            <h2 className="text-2xl font-bold">Continue Learning</h2>
            <ProgressBar
              value={0.65}
              label="Today's Progress"
              showPercentage
            />
            <Button variant="primary" fullWidth>
              Study Now
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
```

---

## RELATED DOCUMENTS

- See **08_DESIGN_SYSTEM.md** for design tokens
- See **16_CODE_STYLE_GUIDE.md** for code standards
- See **10_ACCESSIBILITY.md** for a11y requirements

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF COMPONENT LIBRARY**
