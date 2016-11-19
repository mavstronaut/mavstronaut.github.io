#include "../common/std_headers.h"
#include "./polyfit.h"

/* ----------------------------------------------------------------------
   Evaluate polynomials
*/

double getValue(Polyfit1 const &u, double t)
{
  return u.c0 + t*(u.c1);
}
double getDerivative(Polyfit1 const &u, double t)
{
  return u.c1;
}

double getValue(Polyfit3 const &u, double t)
{
  return u.c0 + t*(u.c1 + (t*(u.c2 + t*u.c3)));
}
double getDerivative(Polyfit3 const &u, double t)
{
  return u.c1 + 2.0*u.c2*t + 3.0*u.c3*t*t;
}

double getValue(Polyfit5 const &u, double t)
{
  return u.c0 + t*(u.c1 + (t*(u.c2 + t*(u.c3 + t*(u.c4 + t*(u.c5))))));
}
double getDerivative(Polyfit5 const &u, double t)
{
  return u.c1 + t*(2.0*u.c2 + t*(3.0*u.c3 + t*(4.0*u.c4 + t*(5.0*u.c5))));
}



/*
  Fit a polynomial to some X and Y data. That is, return a Polyfit{1,3,5} p so that getValue(p, X) approximates Y.
 */

Polyfit1 mkPolyfit1(arma::Col<double> xs, arma::Col<double> ys)
{
  if (xs.n_elem != ys.n_elem) throw runtime_error("incompatible arrays");
  if (xs.n_elem < 2) throw runtime_error ("not enough data");

  arma::mat xsm = arma::mat(xs.n_elem, 2);
  arma::mat ysm = arma::mat(ys.n_elem, 1);

  for (size_t ri=0; ri<xs.n_elem; ri++) {
    double x = xs(ri);
    double y = ys(ri);
    xsm(ri, 0) = 1;
    xsm(ri, 1) = x;
    ysm(ri, 0) = y;
  }

  // Throws runtime_error if no solution
  arma::mat coeffs = arma::solve(xsm, ysm);
  return Polyfit1(coeffs(0,0), coeffs(1,0));
}


Polyfit3 mkPolyfit3(arma::Col<double> xs, arma::Col<double> ys)
{
  if (xs.n_elem != ys.n_elem) throw runtime_error("incompatible arrays");
  if (xs.n_elem < 4) throw runtime_error ("not enough data");

  arma::mat xsm = arma::mat(xs.n_elem, 4);
  arma::mat ysm = arma::mat(ys.n_elem, 1);

  for (size_t ri=0; ri<xs.n_elem; ri++) {
    double x = xs(ri);
    double y = ys(ri);
    xsm(ri, 0) = 1;
    xsm(ri, 1) = x;
    xsm(ri, 2) = x*x;
    xsm(ri, 3) = x*x*x;
    ysm(ri, 0) = y;
  }

  // Throws runtime_error if no solution
  arma::mat coeffs = arma::solve(xsm, ysm);
  return Polyfit3(coeffs(0,0), coeffs(1,0), coeffs(2,0), coeffs(3,0));
}

Polyfit5 mkPolyfit5(arma::Col<double> xs, arma::Col<double> ys)
{
  if (xs.n_elem != ys.n_elem) throw runtime_error("incompatible arrays");
  if (xs.n_elem < 6) throw runtime_error("not enough data");

  arma::mat xsm = arma::mat(xs.n_elem, 6);
  arma::mat ysm = arma::mat(ys.n_elem, 1);

  for (size_t ri=0; ri<xs.n_elem; ri++) {
    double x = xs(ri);
    double y = ys(ri);
    xsm(ri, 0) = 1;
    xsm(ri, 1) = x;
    xsm(ri, 2) = x*x;
    xsm(ri, 3) = x*x*x;
    xsm(ri, 4) = x*x*x*x;
    xsm(ri, 5) = x*x*x*x*x;
    ysm(ri, 0) = y;
  }

  // Throws runtime_error if no solution
  arma::mat coeffs = arma::solve(xsm, ysm);
  return Polyfit5(coeffs(0,0), coeffs(1,0), coeffs(2,0), coeffs(3,0), coeffs(4,0), coeffs(5,0));
}
