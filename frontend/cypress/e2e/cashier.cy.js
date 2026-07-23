describe('Cashier Mode', () => {
  it('should load cashier mode correctly', () => {
    // Assuming logged in as cashier
    cy.visit('/cashier');
    cy.contains('Cashier Mode').should('be.visible');
    // More detailed testing of creating an order would require a full seeded database
  });
});
