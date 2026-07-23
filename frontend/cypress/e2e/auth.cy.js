describe('Authentication', () => {
  it('should allow manager to login', () => {
    cy.visit('/login');
    // Test the login flow
    // Cypress requires a running frontend & backend, so we mock or use test data
    cy.get('input[type="email"]').type('owner@test.com');
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', 'Login').click();
    
    // Check if redirected to admin dashboard
    cy.url().should('include', '/admin');
    cy.contains('Dashboard').should('be.visible');
  });
});
