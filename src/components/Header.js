function Header({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {children ? <div className="header-actions">{children}</div> : null}
    </div>
  );
}

export default Header;
